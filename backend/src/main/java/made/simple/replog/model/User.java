package made.simple.replog.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "app_user")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(unique = true)
    private String username;

    private String password;

    @Column(name = "migration_token", unique = true)
    private UUID migrationToken;

    @Column(name = "migration_token_created_at")
    private Instant migrationTokenCreatedAt;

    public User() {}

    public User(String username, String password) {
        this.username = username;
        this.password = password;
    }

    /**
     * Creates a migration placeholder user — no credentials set yet.
     */
    public static User createMigrationUser(UUID migrationToken) {
        User user = new User();
        user.migrationToken = migrationToken;
        user.migrationTokenCreatedAt = Instant.now();
        return user;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public UUID getMigrationToken() { return migrationToken; }
    public void setMigrationToken(UUID migrationToken) { this.migrationToken = migrationToken; }

    public Instant getMigrationTokenCreatedAt() { return migrationTokenCreatedAt; }
    public void setMigrationTokenCreatedAt(Instant migrationTokenCreatedAt) { this.migrationTokenCreatedAt = migrationTokenCreatedAt; }
}
