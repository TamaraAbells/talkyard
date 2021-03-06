package com.debiki.core

import com.debiki.core.IdentityProvider._
import com.debiki.core.Prelude._
import play.api.libs.json.JsObject



object IdentityProvider {
  // Lowercase, so works in url paths (typically lowercase)
  val ProtoNameOidc = "oidc"
  val ProtoNameOAuth2 = "oauth2"

  def prettyId(confFileIdpId: Opt[ConfFileIdpId], idpId: Opt[IdpId]): St = {
    confFileIdpId.map(s"confFileIdpId: " + _).getOrElse(
          s"idpId: ${idpId getOrDie "TyE306WK245"}")
  }
}


/**
  * @param confFileIdpId — if loaded from the old Silhouette config.
  * @param idpId — a per site IDP kept in idps_t. Then, confFileIdpId.isEmpty.
  * @param protocol
  * @param alias
  * @param enabled
  * @param displayName
  * @param description
  * @param adminComments
  * @param trustVerifiedEmail
  * @param linkAccountNoLogin
  * @param guiOrder
  * @param syncMode — for now, always 1 = ImportOnFirstLogin,
  *  later, also: 2 = SyncOnAllLogins, 3 = ... can get complicated!, see:
  *  https://www.keycloak.org/docs/latest/server_admin/#_identity_broker_first_login
  * @param oauAuthorizationUrl
  * @param oauAuthReqScope
  * @param oauAuthReqClaims — asks the IDP to return some specific claims.
  * @param oauAuthReqClaimsLocales — preferred language in returned OIDC claims.
  *  Space separated list of BCP47 [RFC5646] language tag values.
  * @param oauAuthReqHostedDomain — for Google: any Google GSuite hosted domain(s).
  * @param oauAccessTokenUrl
  * @param oauAccessTokenAuthMethod — default: Basic Auth
  * @param oauClientId
  * @param oauClientSecret
  * @param oauIssuer
  * @param oidcUserInfoUrl
  * @param oidcUserInfoFieldsMap
  * @param oidcUserinfoReqSendUserIp — so Google throttles based on the browser's ip instead
  * @param oidcLogoutUrl
  */
case class IdentityProvider(
  confFileIdpId: Opt[ConfFileIdpId] = None,
  idpId: Opt[IdpId] = None,
  protocol: St,
  alias: St,
  enabled: Bo,
  displayName: Opt[St],
  description: Opt[St],
  adminComments: Opt[St],
  trustVerifiedEmail: Bo,
  linkAccountNoLogin: Bo,
  guiOrder: Opt[i32],
  syncMode: i32,
  oauAuthorizationUrl: St,
  oauAuthReqScope: Opt[St],
  oauAuthReqClaims: Opt[JsObject] = None,
  oauAuthReqClaimsLocales: Opt[St] = None,
  // oau_auth_req_ui_locales: Opt[St],  // preferred language when logging in at the IDP
  // oau_auth_req_display: Opt[St]  // login in popup, full page, touch somehow etc.
  // oau_auth_req_prompt: Opt[St]
  // oau_auth_req_max_age: Opt[i32],
  // oau_auth_req_id_token_hint: Opt[St],  — no.
  // oau_auth_req_access_type: Opt[St],  — online / offline
  // oau_auth_req_include_granted_scopes: Opt[Bo]  // tells the IDP to incl prev auth grants
  oauAuthReqHostedDomain: Opt[St],
  oauAccessTokenUrl: St,
  oauAccessTokenAuthMethod: Opt[St] = None,
  oauClientId: St,
  oauClientSecret: St,
  oauIssuer: Opt[St],
  oidcUserInfoUrl: St,
  oidcUserInfoFieldsMap: Opt[JsObject] = None,
  oidcUserinfoReqSendUserIp: Opt[Bo],
  oidcLogoutUrl: Opt[St],
) {

  require(confFileIdpId.forall(_.trim.nonEmpty), "TyE395RK40M")
  require(idpId.forall(_ >= 1), "TyE395R39W3")
  require(idpId.isDefined != confFileIdpId.isDefined, "TyE602MRDJ2M")

  // OIDC requires 'openid' scope, which we'll include by default — but if the site
  // admins have explicitly specified the scope, it must include 'openid'.
  // (Could match on word boundaries, but, oh well.)
  require(isOAuth2NotOidc || oauAuthReqScope.isEmpty ||
        oauAuthReqScope.get.contains("openid"),
        s"OIDC scope w/o 'openid': '${oauAuthReqScope.get}' [TyEOIDCSCOPE]")

  require(Seq(ProtoNameOidc, ProtoNameOAuth2).contains(protocol), "TyE306RKT")

  require(oauAccessTokenAuthMethod.isEmpty ||
        oauAccessTokenAuthMethod.is("client_secret_basic") ||
        oauAccessTokenAuthMethod.is("client_secret_post"), "TyE305RKT2A3")

  // For now:
  require(oidcUserInfoFieldsMap.isEmpty, "TyE295RKTP")
  // Later, require is obj with St -> St key-values? Maybe use a Map[St, St] instead?

  def protoAlias: St = s"$protocol/$alias"
  def nameOrAlias: St = displayName getOrElse protoAlias
  def prettyId: St = IdentityProvider.prettyId(confFileIdpId, idpId = idpId)


  def isOAuth2NotOidc: Bo = protocol == ProtoNameOAuth2
  def isOpenIdConnect: Bo = protocol == ProtoNameOidc

  def isPerSite: Bo = idpId.isDefined
  def isFromConfFile: Bo = confFileIdpId.isDefined

}

