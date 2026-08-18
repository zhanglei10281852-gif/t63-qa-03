package batch

import (
	"context"
	"strings"
	"testing"
	"time"

	"sanitation-operations/internal/domain/workplan"
	"sanitation-operations/internal/repository"
	"sanitation-operations/internal/service/dispatch"
)

type cancellationStore struct {
	repository.Store
	started chan struct{}
}

func (s cancellationStore) WithTx(ctx context.Context, fn func(context.Context, repository.Tx) error) error {
	return fn(ctx, cancellationTx{started: s.started})
}

type cancellationTx struct {
	repository.Tx
	started chan struct{}
}

func (t cancellationTx) GetShift(ctx context.Context, _ string) (workplan.Shift, error) {
	close(t.started)
	<-ctx.Done()
	return workplan.Shift{}, ctx.Err()
}

func TestBatchAssignmentStopsWhenRequestIsCancelled(t *testing.T) {
	started := make(chan struct{})
	ctx, cancel := context.WithCancel(context.Background())
	service := Service{Dispatch: dispatch.Service{Store: cancellationStore{started: started}}, MaxParallel: 1}
	done := make(chan []Result, 1)
	go func() {
		done <- service.Assign(ctx, []Assignment{{ShiftID: "shift-1", VehicleID: "vehicle-1"}}, "operator-1", "request-1")
	}()
	<-started
	cancel()
	select {
	case results := <-done:
		if len(results) != 1 || !strings.Contains(results[0].Error, "canceled") {
			t.Fatalf("unexpected cancellation results %+v", results)
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatal("batch assignment did not stop after cancellation")
	}
}
