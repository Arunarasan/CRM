package com.arudra.crm.repository;

import com.arudra.crm.entity.GrnPhoto;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GrnPhotoRepository extends JpaRepository<GrnPhoto, Long> {
    List<GrnPhoto> findByGrnId(Long grnId);
}
