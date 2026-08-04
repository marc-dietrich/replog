package made.simple.replog.dto;

import java.util.List;

/**
 * Payload from the old frontend for migration.
 * Exercises and groups are flat lists — exercises reference groups via {@code groupId}.
 * No validation — the endpoint is rate-limited but otherwise trusts the incoming data.
 */
public record MigrateRequest(
    List<MigrateExerciseDto> exercises,
    List<MigrateGroupDto> groups
) {}