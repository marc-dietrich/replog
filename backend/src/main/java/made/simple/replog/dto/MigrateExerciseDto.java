package made.simple.replog.dto;

import java.util.List;

/**
 * An exercise from the old frontend.
 * Uses a string {@code groupId} to reference a group — exercises and groups
 * come as flat lists, not nested.
 */
public record MigrateExerciseDto(
    String name,
    Integer order,
    String groupId,
    List<MigrateEntryDto> entries
) {}