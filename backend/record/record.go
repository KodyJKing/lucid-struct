/*
	This package handles recording of memory reagions in a target process.
*/

package record

import (
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
	data, err := win32.ReadBytes(process, recording.startAddress, recording.size)
	if err != nil {
		return err
	}
	recording.frames = append(recording.frames, data)
	time := time.Now()
	recording.timestamps = append(recording.timestamps, time.UnixMilli())
	return nil
}
