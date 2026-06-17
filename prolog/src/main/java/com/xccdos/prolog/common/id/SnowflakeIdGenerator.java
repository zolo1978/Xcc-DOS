package com.xccdos.prolog.common.id;

import java.time.Instant;
import org.springframework.stereotype.Component;

@Component
public class SnowflakeIdGenerator {

    private static final long EPOCH = Instant.parse("2024-01-01T00:00:00Z").toEpochMilli();
    private static final long NODE_ID = 1L;
    private static final long NODE_ID_BITS = 10L;
    private static final long SEQUENCE_BITS = 12L;
    private static final long MAX_SEQUENCE = ~(-1L << SEQUENCE_BITS);

    private long lastTimestamp = -1L;
    private long sequence = 0L;

    public synchronized long nextId() {
        long timestamp = currentTimestamp();
        if (timestamp < lastTimestamp) {
            throw new IllegalStateException("Clock moved backwards");
        }
        if (timestamp == lastTimestamp) {
            sequence = (sequence + 1) & MAX_SEQUENCE;
            if (sequence == 0) {
                timestamp = waitNextMillis(timestamp);
            }
        } else {
            sequence = 0L;
        }
        lastTimestamp = timestamp;
        return ((timestamp - EPOCH) << (NODE_ID_BITS + SEQUENCE_BITS))
                | (NODE_ID << SEQUENCE_BITS)
                | sequence;
    }

    private long waitNextMillis(long timestamp) {
        long current = currentTimestamp();
        while (current <= timestamp) {
            current = currentTimestamp();
        }
        return current;
    }

    private long currentTimestamp() {
        return System.currentTimeMillis();
    }
}
