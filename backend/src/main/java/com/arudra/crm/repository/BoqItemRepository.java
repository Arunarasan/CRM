package com.arudra.crm.repository;

import com.arudra.crm.entity.BoqItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BoqItemRepository extends JpaRepository<BoqItem, Long> {
    List<BoqItem> findByBoqId(Long boqId);

    List<BoqItem> findByBoqIdAndStatus(Long boqId, String status);

    /**
     * Follows an item's lineage onto a given revision. Cloning a BOQ mints new item rows but
     * carries {@code originItemId} through unchanged, so this is how a work package linked to a
     * pre-revision item finds its counterpart on the current revision.
     */
    Optional<BoqItem> findFirstByBoqIdAndOriginItemId(Long boqId, Long originItemId);
}
