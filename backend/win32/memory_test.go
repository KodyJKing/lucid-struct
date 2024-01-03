package win32

import (
	"fmt"
	"testing"

	"golang.org/x/sys/windows"
)

// Todo: Open a target app automatically.
func TestMemoryUtils(t *testing.T) {
	sysInfo, sysInfoErr := GetNativeSystemInfo()
	if sysInfoErr != 0 { t.Fatalf("Error getting system info.") }
	fmt.Printf("sysInfo.wProcessorArchitecture %d\n", sysInfo.wProcessorArchitecture)

	// Get Notepad window.
	className := "Notepad"
	hwnd, _ := FindWindow(&className, nil)
	if hwnd == 0 { t.Skipf("Notepad isn't open, skipping test.") } // Just pass the test if Notepad isn't open.
	fmt.Printf("HWND: %X\n", hwnd)
	
	// winText := GetWindowText(hwnd)
	// if winText != nil { fmt.Printf("Window text: %s\n", *winText) }
	
	// Get window's pid
	var pid uint32
	_, err := windows.GetWindowThreadProcessId(windows.HWND(hwnd), &pid)
	if err != nil { t.Fatalf("Error getting window's pid:\n%s", err.Error()) }
	fmt.Printf("PID: %X\n", pid)
	
	// Open process and defer closing
	process, err := windows.OpenProcess(
		windows.PROCESS_QUERY_INFORMATION | windows.PROCESS_VM_READ,
		false, pid,
	)
	if err != nil { t.Fatalf("Error opening process:\n%s", err.Error())  }
	defer windows.CloseHandle(process)
	fmt.Printf("Process handle: %X\n", process)

	adr, err := ResolveModulePointer(process, "notepad.exe", []int64{0x23E90})
	if err != nil { t.Fatalf("Error resolving address:\n%s", err.Error())  }
	fmt.Printf("Address: %X\n", adr)

	val, err := ReadMemory[uint32](process, adr)
	if err != nil { t.Fatalf("Error reading memory:\n%s", err.Error())  }
	fmt.Printf("Value: %X\n", val)

	 if val != 0x28EC8348 { t.Errorf("Read unexpected value.") }

	 bytes, _ := ReadBytes(process, adr, 4)
	 fmt.Printf("Bytes: ")
	 for i := 0; i < len(bytes); i++ {
		 fmt.Printf("%X ", bytes[i])
	 }
	 fmt.Println()

	//  t.Fail()
}
