package made.simple.replog.controller;

import made.simple.replog.dto.CreateExerciseRequest;
import made.simple.replog.dto.ExerciseDto;
import made.simple.replog.service.ExerciseService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/exercises")
public class ExerciseController {

    private final ExerciseService exerciseService;

    public ExerciseController(ExerciseService exerciseService) {
        this.exerciseService = exerciseService;
    }

    @PostMapping
    public ExerciseDto create(@RequestBody CreateExerciseRequest request) {
        return exerciseService.create(request);
    }
}