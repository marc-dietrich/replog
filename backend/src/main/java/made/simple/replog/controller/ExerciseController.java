package made.simple.replog.controller;

import made.simple.replog.dto.CreateExerciseRequest;
import made.simple.replog.dto.ExerciseDto;
import made.simple.replog.dto.ReorderExerciseRequest;
import made.simple.replog.service.ExerciseService;

import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
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

    @GetMapping("/ungrouped")
    public List<ExerciseDto> listUngrouped() {
        return exerciseService.listUngrouped();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        exerciseService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/reorder")
    public ResponseEntity<Void> reorder(@RequestBody ReorderExerciseRequest request) {
        exerciseService.reorder(request);
        return ResponseEntity.noContent().build();
    }
}