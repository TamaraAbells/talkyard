/**
 * Copyright (c) 2020 Kaj Magnus Lindberg
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

package talkyard.server.authn

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.dao.{MemCacheKey, SiteDao}
import com.github.scribejava.core.oauth.{OAuth20Service => sj_OAuth20Service}
import com.github.scribejava.core.builder.{ServiceBuilder => sj_ServiceBuilder}
import com.github.scribejava.core.builder.api.{DefaultApi20 => sj_DefaultApi20}
import com.github.scribejava.core.oauth2.clientauthentication.{RequestBodyAuthenticationScheme => sj_RequestBodyAuthenticationScheme}
import org.scalactic.{Good, Bad, Or}



trait AuthnSiteDaoMixin {
  self: SiteDao =>



  // ----- Identity Providers


  def upsertIdentityProviders(idps: Seq[IdentityProvider]): AnyProblem = {
    writeTx { (tx, staleStuff) =>
      idps foreach { idp =>
        tx.upsertIdentityProvider(idp) ifProblem { problem =>
          // Abort the transaction.
          return problem
        }
      }

      // Custom IDP settings are incl in cached html (IDP name shown in login dialog)
      // — and that's visible client side, so need to uncache all pages.
      COULD_OPTIMIZE // A separate bundle for the authn provider config?
      // So won't need to uncache everything.
      SMALLER_BUNDLE // then too.
      staleStuff.addAllPages()
    }

    // Later: Uncache only those that actually got changed.
    uncacheScribeJavaAuthnServices(idps)
    uncacheIdentityProviders(idps)

    Fine
  }


  def getIdentityProviderByAlias(protocol: St, alias: St): Opt[IdentityProvider] = {
    getIdentityProviders(onlyEnabled = false) find { idp =>
      idp.protocol == protocol && idp.alias == alias
    }
  }


  def getIdentityProviderById(id: IdpId): Opt[IdentityProvider] = {
    // Later: lookup server global idps too — but then this fn needs  [srv_glb_idp]
    // more than just an id?
    getIdentityProviders(onlyEnabled = false).find { idp =>
      idp.idpId.is(id)
    }
  }


  def getIdentityProviderNameFor(identity: OpenAuthDetails): Opt[St] = {
    identity.idpId match {
      case Some(id) =>
        // Race: Could be missing, if an admin removed the IDP just now.
        getIdentityProviderById(id).map(_.nameOrAlias)
      case None =>
        // Use the IDs defined by Silhouette, e.g. "google" or "facebook" lowercase :-|
        identity.confFileIdpId
    }
  }


  COULD // rename to sth like getPerSiteIdps ?
  def getIdentityProviders(onlyEnabled: Bo): Seq[IdentityProvider] = {
    val idps = memCache.lookup(
          idpsCacheKey,
          orCacheAndReturn = Some {
            readOnlyTransaction(_.loadAllIdentityProviders())
          }).get
    if (onlyEnabled) idps.filter(_.enabled)
    else idps
  }


  def loadAllIdentityProviders(): Seq[IdentityProvider] = {
    readOnlyTransaction(_.loadAllIdentityProviders())
  }


  def uncacheIdentityProviders(idps: Seq[IdentityProvider]): U = {
    memCache.remove(idpsCacheKey)
  }


  private val idpsCacheKey: MemCacheKey = MemCacheKey(siteId, "Idps")


  // ----- User Identities



  // ----- ScribeJava services


  def uncacheScribeJavaAuthnServices(idpsToUncache: Seq[IdentityProvider]): U = {
    // Later: Uncache only idpsToUncache (both by id, and by protocol + alias).
    memCache.remove(scribeJavaAuthnServicesKey)
  }


  def getScribeJavaAuthnService(origin: St, idp: IdentityProvider, mayCreate: Bo = true)
          : sj_OAuth20Service Or ErrMsg = {

    val redirBackUrl = origin + s"/-/authn/${idp.protocol}/${idp.alias}/redirback"

    // For now: Just one IDP. (If >= 2 used at the same time, one would get
    // uncached, login would fail.)
    val service = memCache.lookup(
          scribeJavaAuthnServicesKey,
          orCacheAndReturn = Some {
            // As of 2020-10, all per site custom OAuth2 IDPs behave like OIDC,
            // until the very end of the authn flow, when they return non-standard
            // user info json. So, using OIDC here works fine (as of now)
            // — we just need to read the right user info json fields, later,
            // with the help of oidc_user_info_fields_map_c.
            if (idp.isOpenIdConnect || idp.isPerSite)
              Good(createScribeJavaOidcService(idp, redirBackUrl))
            else
              tryCreateScribeJavaOAuth2Service(idp, redirBackUrl)
          },
          //expireAfterSeconds = Some(3600)  // unimpl though — need a 2nd Coffeine cache? [mem_cache_exp_secs]
          ).get.getOrIfBad { errMsg =>
            return Bad(errMsg)
          }

    // It's the right IDP, same config settings?
    // (The redirBackUrl includes both the protocol and IDP alias, and the
    // client id and secret are very unique too.)

    def correctAccessTokenAuthMethod: Bo =
          (service.getApi.getClientAuthentication ==
                sj_RequestBodyAuthenticationScheme.instance()
          ) == idp.oauAccessTokenAuthMethod.is("client_secret_post")

    def correctOAuth2Config: Bo = service.getApi match {
      case oauApi: sj_DefaultApi20 =>
        // Or maybe do these checks only for TyOidcScribeJavaApi20?
        // And assume ScribeJava's built-in config for "well known" OAuth2
        // IDPs (e.g. Google, FB) is correct? Otherwise site admins would
        // need to configure OAuth2 auth and access token urls, although
        // ScribeJava later would use its own built-in urls anyway?
        // Then need a way for a site admin to tell Talkyard which
        // built-in ScribeJava IDP hen wants to use? [scribejava_oauth2]
        val apiAuthUrlInclQuerySt = oauApi.getAuthorizationUrl(
              "", "", "", "", "", new java.util.HashMap())
        (apiAuthUrlInclQuerySt.startsWith(idp.oauAuthorizationUrl + '?')
              && oauApi.getAccessTokenEndpoint == idp.oauAccessTokenUrl)
      case weirdApi =>
        // Only OAuth2 and OIDC supported.
        bugWarn("TyE3B5MA05MR", s"Weird API: ${classNameOf(weirdApi)}")
        false
    }

    if (idp.oauAuthReqScope.isSomethingButNot(service.getDefaultScope)
        || service.getCallback != redirBackUrl
        || service.getApiKey != idp.oauClientId
        || service.getApiSecret != idp.oauClientSecret
        || !correctAccessTokenAuthMethod
        || !correctOAuth2Config) {
      // It's the wrong. An admin recently changed OIDC settings?
      // Remove old, create new.
      uncacheScribeJavaAuthnServices(Seq(idp))

      // No eternal recursion.
      if (!mayCreate)
        return Bad("Error creating ScribeJava service: Recursion [TyE8R30M4]")

      return getScribeJavaAuthnService(origin, idp, mayCreate = false)
    }

    Good(service)
  }


  private def createScribeJavaOidcService(idp: IdentityProvider, redirBackUri: St)
          : sj_OAuth20Service = {
    new sj_ServiceBuilder(idp.oauClientId)
          .apiSecret(idp.oauClientSecret)
          .defaultScope(idp.oauAuthReqScope getOrElse "openid")
          .callback(redirBackUri)
          .debug()
          .build(TyOidcScribeJavaApi20(idp))
  }


  private def tryCreateScribeJavaOAuth2Service(idp: IdentityProvider, redirBackUri: St)
          : sj_OAuth20Service Or ErrMsg = {
    dieIf(!idp.isOAuth2NotOidc, "TyE305MARKP24")

    val SDIA = ServerDefIdpAliases
    import com.github.scribejava.{apis => a}

    val (idpApi: sj_DefaultApi20, idpDefaultScopes: St) = idp.alias match {
      case SDIA.Google => (a.GoogleApi20.instance(), "profile email")
      case SDIA.GitHub => (a.GitHubApi.instance(), "read:user,user:email")
      case SDIA.Facebook => (a.FacebookApi.instance(), "email")
      //case SDIA.Twitter => ...
      case SDIA.LinkedIn => (a.FacebookApi.instance(), "r_liteprofile r_emailaddress")
      case _ =>
        return Bad(
              s"Identity Provider (IDP) not yet supported: ${idp.protoAlias}")
    }

    val service = new sj_ServiceBuilder(idp.oauClientId)
          .apiSecret(idp.oauClientSecret)
          .defaultScope(idp.oauAuthReqScope getOrElse idpDefaultScopes)
          .callback(redirBackUri)
          .debug()
          // ?? .httpClientConfig(clientConfig)
          .build(idpApi)

    Good(service)
  }


  private val scribeJavaAuthnServicesKey: MemCacheKey = MemCacheKey(siteId, "AzN")

}
