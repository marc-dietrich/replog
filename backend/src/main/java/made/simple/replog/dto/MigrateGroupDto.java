package made.simple.replog.dto;

import java.time.Instant;
import java.util.UUID;

/**
 * A group from the old frontend.
 * {@code id} is the old string ID used for mapping exercises via {@code groupId}.
 * {@code uuid} is the client-generated UUID that becomes the entity PK (R2).
 * Groups come as a flat list — they don't nest exercises.
 */
public record MigrateGroupDto(
    String id,
    UUID uuid,
    String name,
    Integer order,
    Instant createdAt,
    Instant updatedAt
) {}