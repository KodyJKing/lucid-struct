// Windows helpers and wrappers for Windows APIs not in "golang.org/x/sys/windows"

package win32

import (
	"fmt"
	"path/filepath"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

type SystemInfo struct {
	wProcessorArchitecture uint16;
	wReserved uint16;
	dwPageSize uint32;
	lpMinimumApplicationAddress uintptr;
	lpMaximumApplicationAddress uintptr;
	dwActiveProcessorMask uintptr;
	dwNumberOfProcessors uint32;
	dwProcessorType uint32;
	dwAllocationGranularity uint32;
	wProcessorLevel uint16;
	wProcessorRevision uint16;
}


func FormatSysError(errNo syscall.Errno) error { 
	if errNo == 0 { return nil }
	return fmt.Errorf(errNo.Error())
}

var (
	user32, _ = syscall.LoadLibrary("user32.dll")
	kernel32, _ = syscall.LoadLibrary("kernel32.dll")

	getAsyncKeyState, _ = syscall.GetProcAddress(user32, "GetAsyncKeyState")
	findWindowW, _      = syscall.GetProcAddress(user32, "FindWindowW")
	getWindowTextW, _   = syscall.GetProcAddress(user32, "GetWindowTextW")
	enumWindows, _      = syscall.GetProcAddress(user32, "EnumWindows")
	
	readProcessMemory, _   = syscall.GetProcAddress(kernel32, "ReadProcessMemory")
	writeProcessMemory, _   = syscall.GetProcAddress(kernel32, "WriteProcessMemory")
	getNativeSystemInfo, _   = syscall.GetProcAddress(kernel32, "GetNativeSystemInfo")
)

func GetAsyncKeyState(vk int) int16 {
	ret, _, callErr := syscall.SyscallN(uintptr(getAsyncKeyState), uintptr(vk))
	if callErr != 0 {
		return 0
	}
	return int16(ret)
}

func FindWindow(className *string, windowName *string) (hwnd uintptr, err error) {
	eClassName := externString16(className)
	eWindowName := externString16(windowName)
	hwnd, _, err = syscall.SyscallN(uintptr(findWindowW), eClassName.addr, eWindowName.addr)
	return
}

func GetWindowText(hwnd uintptr) *string {
	maxChars := uintptr(windows.MAX_PATH)
	eString := allocExternString16(maxChars)
	_, _, err := syscall.SyscallN(uintptr(getWindowTextW), hwnd, eString.addr, maxChars)
	if err != 0 {
		return nil
	}
	result := eString.toString()
	return &result
}

// More powerful than windows.ReadProcessMemory because it takes an unsafe.Pointer, making it easier to type the destination.
func ReadProcessMemory(process windows.Handle, baseAddress uintptr, buffer unsafe.Pointer, size uintptr, numberOfBytesRead *uintptr) (err syscall.Errno) {
	_, _, err = syscall.SyscallN(
		uintptr(readProcessMemory), 
		uintptr(process), 
		baseAddress, 
		uintptr(buffer),
		size,
		uintptr(unsafe.Pointer(numberOfBytesRead)),
	)
	return
}

func WriteProcessMemory(process windows.Handle, baseAddress uintptr, buffer unsafe.Pointer, size uintptr, numberOfBytesWritten *uintptr) (err syscall.Errno) {
	_, _, err = syscall.SyscallN(
		uintptr(writeProcessMemory), 
		uintptr(process), 
		baseAddress, 
		uintptr(buffer),
		size,
		uintptr(unsafe.Pointer(numberOfBytesWritten)),
	)
	return
}

var _systemInfo, _systemInfoErrNo = _GetNativeSystemInfo()
func _GetNativeSystemInfo() (systemInfo SystemInfo, errNo syscall.Errno) {
	_, _, errNo = syscall.SyscallN(
		uintptr(getNativeSystemInfo),
		uintptr(unsafe.Pointer(&systemInfo)),
	)
	return
}
func GetNativeSystemInfo() (systemInfo SystemInfo, errNo syscall.Errno) {
	// I don't think we ever need to call GetNativeSystemInfo more than once.
	systemInfo = _systemInfo
	errNo = _systemInfoErrNo
	return
}

func IsX64Machine() (isX64 bool, err syscall.Errno) {
	sysInfo, err := GetNativeSystemInfo()
	if err != 0 { return }
	isX64 = sysInfo.wProcessorArchitecture == 9
	return
}

func IsX64Process(process windows.Handle) (isX64 bool, err syscall.Errno) {
	x64Machine, err := IsX64Machine()
	if err != 0 { return }
	var isWow64 bool
	windows.IsWow64Process(process, &isWow64)
	isX64 = x64Machine && !isWow64
	return
}

type ProcessInfo struct { Pid uint32 `json:"pid"`; Filename string `json:"filename"`; }
func EnumProcessInfo() (infos []ProcessInfo, err error) {
	var processIds [1024]uint32
	var bytesReturned uint32
	err = windows.EnumProcesses(processIds[:], &bytesReturned)
	if err != nil { return }
	pidsReturned := bytesReturned / 4

	for i := 0; i < int(pidsReturned); i++ {
		var info ProcessInfo
		info.Pid = processIds[i]
		
		filename, err := GetFileNameForPid(info.Pid)
		if err != nil { continue }
		info.Filename = filename
		
		infos = append(infos, info)
	}

	return
}

// Like EnumProcessInfo, but only includes apps with atleast one window.
// Usefull for detecting GUI apps that the user may want to open.
func EnumAppProcessInfo() (infos []ProcessInfo) {
	hwnds, err := EnumWindows()
	if err != nil { return } // Todo, add error return to this api.

	var visited map[uint32]bool = map[uint32]bool{}

	for _, hwnd := range hwnds {
		var info ProcessInfo
		_, e := windows.GetWindowThreadProcessId(hwnd, &info.Pid)
		if e != nil || visited[info.Pid] { continue }
		visited[info.Pid] = true
		filename, err := GetFileNameForPid(info.Pid)
		if err != nil { continue }
		info.Filename = filename

		infos = append(infos, info)
	}

	return
}

func enumWindowsCallback(hwnd windows.HWND, windows *[]windows.HWND) uintptr {
	*windows = append(*windows, hwnd)
	return uintptr(1)
}
var enumWindowsCallback_CWrapper = syscall.NewCallback(enumWindowsCallback)
func EnumWindows() (windows []windows.HWND, err error)  {
	_, _, errNo := syscall.SyscallN(
		uintptr(enumWindows),
		enumWindowsCallback_CWrapper,
		uintptr(unsafe.Pointer(&windows)),
	)
	if errNo != 0 { err = FormatSysError(errNo) }
	return
}

func GetFileNameForPid(pid uint32) (name string, err error) {
	process, err := windows.OpenProcess(windows.PROCESS_QUERY_INFORMATION, false, pid)
	if err != nil { return }
	defer windows.CloseHandle(process)
	
	buffer := make([]uint16, windows.MAX_PATH)
	err = windows.GetModuleFileNameEx(process, windows.Handle(0), &buffer[0], windows.MAX_PATH)
	if err != nil { return }

	modulePath := syscall.UTF16ToString(buffer)
	name = filepath.Base(modulePath)

	return
}

func GetPidByFileName(name string) (pid uint32, err error) {
	infos, err := EnumProcessInfo()
	if err != nil { return }
	for _, info := range(infos) {
		if info.Filename == name {
			pid = info.Pid
			return
		}
	}
	err = fmt.Errorf("Process with filename \"%s\" not found.", name)
	return
}

// External UTF-16 string helpers

type ExternString16 struct {
	buf  []uint16
	addr uintptr
}

func (es *ExternString16) toString() string {
	return syscall.UTF16ToString(es.buf)
}

func externString16(str *string) (result ExternString16) {
	if str != nil {
		result.buf, _ = syscall.UTF16FromString(*str)
		result.addr = uintptr(unsafe.Pointer(&result.buf[0]))
	}
	return
}

func allocExternString16(size uintptr) (result ExternString16) {
	result.buf = make([]uint16, size+1)
	result.addr = uintptr(unsafe.Pointer(&result.buf[0]))
	return
}