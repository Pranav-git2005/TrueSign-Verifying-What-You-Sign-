package com.truesign.events;

import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class PassportEventPublisher {

    private final CopyOnWriteArrayList<SseEmitter> clients =
            new CopyOnWriteArrayList<>();

    public SseEmitter subscribe() {

        SseEmitter emitter = new SseEmitter(0L);

        clients.add(emitter);

        emitter.onCompletion(() -> clients.remove(emitter));
        emitter.onTimeout(() -> clients.remove(emitter));
        emitter.onError(error -> clients.remove(emitter));

        try {
            emitter.send(
                    SseEmitter.event()
                            .name("CONNECTED")
                            .data(Map.of(
                                    "event", "CONNECTED",
                                    "timestamp", Instant.now().toString(),
                                    "message", "Connected to TrueSign live event stream"
                            ))
            );
        } catch (IOException exception) {
            clients.remove(emitter);
            emitter.completeWithError(exception);
        }

        return emitter;
    }

    public void publish(String eventName, Map<String, Object> payload) {

        for (SseEmitter emitter : clients) {
            try {
                emitter.send(
                        SseEmitter.event()
                                .name(eventName)
                                .data(payload)
                );
            } catch (IOException | IllegalStateException exception) {
                clients.remove(emitter);
                emitter.complete();
            }
        }
    }

    public int getConnectedClientCount() {
        return clients.size();
    }
}