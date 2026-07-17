package made.simple.replog.service;

import made.simple.replog.dto.CreateExerciseRequest;
import made.simple.replog.dto.EntryDto;
import made.simple.replog.dto.ExerciseDto;
import made.simple.replog.model.Entry;
import made.simple.replog.model.Exercise;
import made.simple.replog.model.Group;
import made.simple.replog.repository.ExerciseRepository;
import made.simple.replog.repository.GroupRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
public class ExerciseService {

    private final ExerciseRepository exerciseRepository;
    private final GroupRepository groupRepository;

    public ExerciseService(ExerciseRepository exerciseRepository, GroupRepository groupRepository) {
        this.exerciseRepository = exerciseRepository;
        this.groupRepository = groupRepository;
    }

    @Transactional
    public ExerciseDto create(CreateExerciseRequest request) {
        Group group = groupRepository.findById(request.groupId())
            .orElseThrow(() -> new EntityNotFoundException("Group nicht gefunden: " + request.groupId()));

        Exercise exercise = new Exercise();
        exercise.setName(request.name());
        exercise.setOrder(request.order());
        exercise.setGroup(group);

        return toDto(exerciseRepository.save(exercise));
    }

    private ExerciseDto toDto(Exercise exercise) {
        List<EntryDto> entryDtos = exercise.getEntries().stream()
            .map(e -> new EntryDto(e.getId(), e.getDate(), e.getWeight(), e.getReps(), e.getNote()))
            .toList();
        return new ExerciseDto(exercise.getId(), exercise.getName(), exercise.getOrder(), entryDtos);
    }
}