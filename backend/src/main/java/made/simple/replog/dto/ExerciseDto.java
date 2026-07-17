package made.simple.replog.dto;

import java.util.List;
import java.util.UUID;

public record ExerciseDto(
    UUID id,
    String name,
    Integer order,
    List<EntryDto> entries
) {}