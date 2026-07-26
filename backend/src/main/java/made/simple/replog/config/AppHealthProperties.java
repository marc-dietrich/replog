package made.simple.replog.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.health")
public record AppHealthProperties(int dbTimeoutSeconds) {
}
