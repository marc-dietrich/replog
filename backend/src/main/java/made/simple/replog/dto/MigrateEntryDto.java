package made.simple.replog.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record MigrateEntryDto(
    LocalDate date,
    BigDecimal weight,
    Integer reps,
    String note
) {}