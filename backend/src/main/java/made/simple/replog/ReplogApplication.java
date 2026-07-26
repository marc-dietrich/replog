package made.simple.replog;

import made.simple.replog.config.AppCorsProperties;
import made.simple.replog.config.AppHealthProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.transaction.annotation.EnableTransactionManagement;

@SpringBootApplication
@EnableTransactionManagement(order = 0)
@EnableConfigurationProperties({AppHealthProperties.class, AppCorsProperties.class})
public class ReplogApplication {

	public static void main(String[] args) {
		SpringApplication.run(ReplogApplication.class, args);
	}

}
