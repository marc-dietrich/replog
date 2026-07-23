package made.simple.replog.dto;

public record CreateGroupRequest(
    String name,
    Integer order
) {}