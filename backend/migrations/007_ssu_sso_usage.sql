-- Existing users/identities already support nullable email and distinct issuers.
-- Preserve user UUIDs, trip ownership and sessions; add only the new service tag.
ALTER TABLE trasolve.external_api_call_events
    DROP CONSTRAINT external_api_service_allowed;
ALTER TABLE trasolve.external_api_call_events
    ADD CONSTRAINT external_api_service_allowed CHECK (service IN (
        'google-places', 'google-routes', 'gemini', 'openwebui',
        'troute', 'tcache', 'google-oauth', 'ssu-sso'
    ));
