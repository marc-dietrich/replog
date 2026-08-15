package made.simple.replog.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * An exercise from the old frontend.
 * Uses a string {@code groupId} to reference a group — exercises and groups
 * come as flat lists, not nested. {@code uuid} is the client-generated UUID
 * that becomes the entity PK (R2).
 */
public record MigrateExerciseDto(
    String name,
    Integer order,
    String groupId,
    UUID uuid,
    Instant createdAt,
    Instant updatedAt,
    List<MigrateEntryDto> entries
) {}