package made.simple.replog.controller;

import made.simple.replog.config.AppHealthProperties;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.time.Instant;
import java.util.Map;

@RestController
public class HealthController {

    private final DataSource dataSource;
    private final AppHealthProperties healthProperties;

    public HealthController(DataSource dataSource, AppHealthProperties healthProperties) {
        this.dataSource = dataSource;
        this.healthProperties = healthProperties;
    }

    @GetMapping("/api/health")
    public ResponseEntity<Map<String, Object>> health() {
        boolean dbUp;
        try (var conn = dataSource.getConnection()) {
            dbUp = conn.isValid(healthProperties.dbTimeoutSeconds());
        } catch (Exception e) {
            dbUp = false;
        }

        var body = Map.<String, Object>of(
                "status", dbUp ? "UP" : "DOWN",
                "db", dbUp ? "UP" : "DOWN",
                "timestamp", Instant.now().toString()
        );

        return ResponseEntity.ok(body);
    }
}
