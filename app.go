package main

import (
	"context"
	"fmt"
	"lucidstruct/backend/record"
	"lucidstruct/backend/win32"
	"strconv"
	"time"

	"golang.org/x/sys/windows"
)

// App struct
type App struct {
	ctx context.Context

	pid uint32 // The process ID of the target process
	process windows.Handle // The handle to the target process

	currentRecording *record.Recording
	stopRecording chan bool
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) ReadBytes(pid uint32, address string, size uint64) ([]byte, error) {
	// Parse address as hex
	// fmt.Printf("Address string: %s\n", address)
	addressInt, err := strconv.ParseUint(address, 16, 64)
	if err != nil {
		return nil, err
	}

	// fmt.Printf("Read %d bytes from address %d\n", size, addressInt)

	// Open the process
	process, err := windows.OpenProcess( windows.PROCESS_VM_READ, false, pid)
	if err != nil {
		return nil, err
	}
	bytes, err := win32.ReadBytes(process, addressInt, size)
	
	windows.CloseHandle(process)

	return bytes, err
}

func (a *App) StartRecording(pid uint32, startAddressString string, size uint64, capturePeriodMS uint32) error {
	// Parse address as hex
	startAddress, err := strconv.ParseUint(startAddressString, 16, 64)
	if err != nil {
		return err
	}

	fmt.Printf("Start recording at address %d, size %d\n", startAddress, size)

	// Open the process
	a.pid = pid
	process, err := windows.OpenProcess( windows.PROCESS_VM_READ, false, pid)
	if err != nil {
		return err
	}
	a.process = process

	a.currentRecording = record.NewRecording(startAddress, size)
	a.stopRecording = make(chan bool)

	go func() {
		for {
			select {
			case <-a.stopRecording:
				return
			default:
				err := a.currentRecording.CaptureFrame(a.process)
				if err != nil {
					fmt.Printf("Error capturing frame: %s\n", err)
				}
			}

			// Sleep for the capture period
			time.Sleep(time.Duration(capturePeriodMS) * time.Millisecond)
		}
	}()

	return nil
}

func (a *App) StopRecord() {
	fmt.Printf("Stop recording\n")

	// Stop the recording goroutine
	a.stopRecording <- true
}

func (a *App) EnumAppProcessInfo() (infos []win32.ProcessInfo) {
	return win32.EnumAppProcessInfo()
}