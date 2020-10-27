
alter table settings3 drop constraint settings_c_startofbodyhtml_len;
alter table settings3 drop constraint settings3_endofbodyhtml__c_len;
alter table settings3 drop constraint settings3_footerhtml__c_len;
alter table settings3 drop constraint settings3_headerhtml__c_len;
alter table settings3 drop constraint settings3_logourlorhtml__c_len;
alter table settings3 drop constraint settings_c_navconf_len;
alter table settings3 drop constraint settings3_headscriptshtml__c_len;
alter table settings3 drop constraint settings3_headstyleshtml__c_len;
alter table settings3 drop constraint settings3_sociallinkshtml__c_len;
alter table settings3 drop constraint settings_c_emailblacklist_len;
alter table settings3 drop constraint settings_c_emailwhitelist_len;


alter table settings3 add constraint settings_c_startofbodyhtml_len check (length(start_of_body_html::text) >= 1 AND length(start_of_body_html::text) <= 50000);
alter table settings3 add constraint settings_c_endofbodyhtml_len check (length(end_of_body_html::text) >= 1 AND length(end_of_body_html::text) <= 50000);
alter table settings3 add constraint settings_c_footerhtml_len check (length(footer_html::text) >= 1 AND length(footer_html::text) <= 50000);
alter table settings3 add constraint settings_c_headerhtml_len check (length(header_html::text) >= 1 AND length(header_html::text) <= 50000);
alter table settings3 add constraint settings_c_logourlorhtml_len check (length(logo_url_or_html::text) >= 1 AND length(logo_url_or_html::text) <= 50000);
alter table settings3 add constraint settings_c_navconf_len check (pg_column_size(nav_conf) <= 50000);
alter table settings3 add constraint settings_c_headscriptshtml_len check (length(head_scripts_html::text) >= 1 AND length(head_scripts_html::text) <= 50000);
alter table settings3 add constraint settings_c_headstyleshtml_len check (length(head_styles_html::text) >= 1 AND length(head_styles_html::text) <= 50000);
alter table settings3 add constraint settings_c_sociallinkshtml_len check (length(social_links_html::text) >= 1 AND length(social_links_html::text) <= 50000);
alter table settings3 add constraint settings_c_emailblocklist_len check (length(email_domain_blacklist::text) >= 1 AND length(email_domain_blacklist::text) <= 50000);
alter table settings3 add constraint settings_c_emailallowlist_len check (length(email_domain_whitelist::text) >= 1 AND length(email_domain_whitelist::text) <= 50000);


