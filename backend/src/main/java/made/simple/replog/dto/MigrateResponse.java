package made.simple.replog.dto;

/**
 * Response from POST /api/migrate — contains the redirect URL
 * with the migration token in the fragment (not query param).
 */
public record MigrateResponse(
    String redirectUrl
) {}