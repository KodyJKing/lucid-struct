/*
	This package handles recording of memory reagions in a target process.
*/

package record

import (
	"fmt"
	"lucidstruct/backend/win32"
	"time"

	"golang.org/x/sys/windows"
)


type Recording struct  {
	startAddress uint64
	size uint64
	frames [][]byte
	timestamps []int64
}

func NewRecording(startAddress uint64, size uint64) *Recording {
	return &Recording{
		startAddress: startAddress,
		size: size,
	}
}

func (recording *Recording) CaptureFrame(process windows.Handle) error {
	if (recording == nil) {
		return fmt.Errorf("Recording is nil")
	}

	startTime := time.Now()
	data, err := win32.ReadBytes(process, recording.startAddress, recording.size)
	endTime := time.Now()
	timeNano := (startTime.UnixNano() + endTime.UnixNano()) / 2
	timeMilli := timeNano / 1000000
	
	if err != nil {
		return err
	}
	recording.frames = append(recording.frames, data)
	recording.timestamps = append(recording.timestamps, timeMilli)

	return nil
}

func (recording *Recording) GetFrame(time int64) ([]byte, error) {
	if (recording == nil) {
		return nil, fmt.Errorf("Recording is nil")
	}

	if (len(recording.frames) == 0) {
		return nil, fmt.Errorf("No frames captured")
	}
	index := recording.FrameIndex(time)
	if (index < 0) {
		index = 0
	}
	if (index >= len(recording.frames)) {
		index = len(recording.frames) - 1
	}
	return recording.frames[index], nil
}

func (recording *Recording) FrameIndex(time int64) int {
	if (recording == nil) {
		fmt.Printf("Recording is nil!\n")
		return -1
	}

	// Binary search for first frame with timestamp >= time
	index := 0
	low := 0
	high := len(recording.timestamps) - 1
	for low <= high {
		mid := (low + high) / 2
		if recording.timestamps[mid] < time {
			low = mid + 1
		} else {
			index = mid
			high = mid - 1
		}
	}

	return index
}