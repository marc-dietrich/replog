package made.simple.replog.controller;

import jakarta.validation.Valid;
import made.simple.replog.dto.ClaimRequest;
import made.simple.replog.dto.MigrateRequest;
import made.simple.replog.dto.MigrateResponse;
import made.simple.replog.dto.UserDto;
import made.simple.replog.service.MigrationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/migrate")
public class MigrationController {

    private final MigrationService migrationService;

    public MigrationController(MigrationService migrationService) {
        this.migrationService = migrationService;
    }

    @PostMapping
    public ResponseEntity<MigrateResponse> migrate(@RequestBody MigrateRequest request) {
        MigrateResponse response = migrationService.migrate(request);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/claim")
    public ResponseEntity<UserDto> claim(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @Valid @RequestBody ClaimRequest request) {

        UUID token = extractToken(authHeader, request);
        UserDto user = migrationService.claim(token, request);
        return ResponseEntity.ok(user);
    }

    /**
     * Extracts the migration token from the Authorization header (Bearer scheme).
     * Falls back to null if header is missing — service layer will reject with a
     * generic error to avoid information leakage.
     */
    private UUID extractToken(String authHeader, ClaimRequest request) {
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            try {
                return UUID.fromString(authHeader.substring(7).trim());
            } catch (IllegalArgumentException e) {
                throw new IllegalArgumentException("Invalid or expired migration token");
            }
        }
        throw new IllegalArgumentException("Invalid or expired migration token");
    }
}
