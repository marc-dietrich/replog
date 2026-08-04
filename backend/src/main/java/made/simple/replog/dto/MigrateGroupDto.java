package made.simple.replog.dto;

/**
 * A group from the old frontend.
 * {@code id} is the old string ID used for mapping exercises via {@code groupId}.
 * Groups come as a flat list — they don't nest exercises.
 */
public record MigrateGroupDto(
    String id,
    String name,
    Integer order
) {}