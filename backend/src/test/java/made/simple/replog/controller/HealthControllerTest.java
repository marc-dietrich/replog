package made.simple.replog.controller;

import made.simple.replog.config.AppHealthProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import javax.sql.DataSource;
import java.sql.Connection;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class HealthControllerTest {

    private DataSource dataSource;
    private Connection connection;
    private AppHealthProperties healthProperties;
    private HealthController healthController;

    @BeforeEach
    void setUp() {
        dataSource = mock(DataSource.class);
        connection = mock(Connection.class);
        healthProperties = new AppHealthProperties(3);
        healthController = new HealthController(dataSource, healthProperties);
    }

    @Test
    void health_returnsUp_whenDbIsReachable() throws Exception {
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.isValid(3)).thenReturn(true);

        var response = healthController.health();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("status", "UP");
        assertThat(response.getBody()).containsEntry("db", "UP");
        assertThat(response.getBody()).containsKey("timestamp");
    }

    @Test
    void health_returnsDown_whenDbConnectionFails() throws Exception {
        when(dataSource.getConnection()).thenThrow(new RuntimeException("Connection refused"));

        var response = healthController.health();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("status", "DOWN");
        assertThat(response.getBody()).containsEntry("db", "DOWN");
        assertThat(response.getBody()).containsKey("timestamp");
    }

    @Test
    void health_returnsDown_whenDbIsInvalid() throws Exception {
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.isValid(3)).thenReturn(false);

        var response = healthController.health();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("status", "DOWN");
        assertThat(response.getBody()).containsEntry("db", "DOWN");
        assertThat(response.getBody()).containsKey("timestamp");
    }
}
