package com.arudra.crm.service;

import com.arudra.crm.entity.ActivityLog;
import com.arudra.crm.repository.ActivityLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ActivityLogService {

    private final ActivityLogRepository activityLogRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void saveLog(ActivityLog log) {
        activityLogRepository.save(log);
    }
}
