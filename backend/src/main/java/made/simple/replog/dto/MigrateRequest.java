package made.simple.replog.dto;

import java.util.List;

/**
 * Payload from the old frontend for migration.
 * Contains all user data: ungrouped exercises, groups with nested exercises and entries.
 * No validation — the endpoint is rate-limited but otherwise trusts the incoming data.
 */
public record MigrateRequest(
    List<MigrateExerciseDto> exercises,
    List<MigrateGroupDto> groups
) {}