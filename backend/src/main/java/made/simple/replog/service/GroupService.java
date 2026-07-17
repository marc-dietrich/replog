package made.simple.replog.service;

import made.simple.replog.dto.EntryDto;
import made.simple.replog.dto.ExerciseDto;
import made.simple.replog.dto.GroupDto;
import made.simple.replog.model.Entry;
import made.simple.replog.model.Exercise;
import made.simple.replog.model.Group;
import made.simple.replog.repository.GroupRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
public class GroupService {

    private final GroupRepository groupRepository;

    public GroupService(GroupRepository groupRepository) {
        this.groupRepository = groupRepository;
    }

    @Transactional(readOnly = true)
    public List<GroupDto> listAll() {
        return groupRepository.findAll().stream()
            .map(this::toDto)
            .toList();
    }

    private GroupDto toDto(Group group) {
        List<ExerciseDto> exerciseDtos = group.getExercises().stream()
            .map(this::toDto)
            .toList();
        return new GroupDto(group.getId(), group.getName(), group.getOrder(), exerciseDtos);
    }

    private ExerciseDto toDto(Exercise exercise) {
        List<EntryDto> entryDtos = exercise.getEntries().stream()
            .map(this::toDto)
            .toList();
        return new ExerciseDto(exercise.getId(), exercise.getName(), exercise.getOrder(), entryDtos);
    }

    private EntryDto toDto(Entry entry) {
        return new EntryDto(entry.getId(), entry.getDate(), entry.getWeight(), entry.getReps(), entry.getNote());
    }
}