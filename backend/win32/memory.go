package win32

import (
	"fmt"
	"sync"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

func IAbs[T int8 | int16 | int32 | int64](a T) T {
	if a < 0 {
		return -a
	}
	return a
}

func AddOffset[PTR uint32 | uint64](ptr PTR, offset int64) PTR {
	if offset < 0 {
		return ptr - PTR(IAbs(offset))
	} else {
		return ptr + PTR(offset)
	}
}


func _ResolvePointer[PTR uint32 | uint64](process windows.Handle, base PTR, offsets []int64) (address PTR, err error) {
	if (len(offsets) == 0) {
		address = base
		return
	}
	address = AddOffset(base, offsets[0])
	for i := 1; i < len(offsets); i++ {
		val, e := ReadMemory[PTR](process, uint64(address))
		if e != nil { err = e; return }
		address = AddOffset(val, offsets[i])
	}
	return
}

func ResolvePointer(process windows.Handle, base uint64, offsets []int64) (address uint64, err error) {
	isX64, _ := IsX64Process(process)
	if isX64 {
		address64, readErr := _ResolvePointer[uint64](process, base, offsets)
		address = uint64(address64)
		err = readErr
	} else {
		address32, readErr := _ResolvePointer[uint32](process, uint32(base), offsets)
		address = uint64(address32)
		err = readErr
	}
	return
}

func _ResolveModulePointer[PTR uint32 | uint64](process windows.Handle, module string, offsets []int64) (address PTR, err error) {
	hModule, err := GetExternalModuleHandle(process, module)
	if err != nil { return }
	return _ResolvePointer(process, PTR(hModule), offsets)
}

func ResolveModulePointer(process windows.Handle, module string, offsets []int64) (address uint64, err error) {
	isX64, _ := IsX64Process(process)
	if isX64 {
		address64, readErr := _ResolveModulePointer[uint64](process, module, offsets)
		address = uint64(address64)
		err = readErr
	} else {
		address32, readErr := _ResolveModulePointer[uint32](process, module, offsets)
		address = uint64(address32)
		err = readErr
	}
	return
}

// Read Uintptr from process memory
func ReadUintptr(process windows.Handle, address uint64) (value uintptr, err error) {
	isX64, _ := IsX64Process(process)
	if isX64 {
		value64, readErr := ReadMemory[uint64](process, address)
		value = uintptr(value64)
		err = readErr
	} else {
		value32, readErr := ReadMemory[uint32](process, address)
		value = uintptr(value32)
		err = readErr
	}
	return
}

func ReadMemory[K any](process windows.Handle, address uint64) (value K, err error) {
	size := unsafe.Sizeof(value)
	var bytesRead uintptr
	errNo := ReadProcessMemory(process, uintptr(address), unsafe.Pointer(&value), size, &bytesRead)
	if errNo != 0 { err = FormatSysError(errNo); return }
	if bytesRead < size { err = fmt.Errorf("Could not read all bytes.") }
	return
}

func WriteMemory[K any](process windows.Handle, address uint64, value K) (err error) {
	size := unsafe.Sizeof(value)
	var bytesWritten uintptr
	errNo := WriteProcessMemory(process, uintptr(address), unsafe.Pointer(&value), size, &bytesWritten)
	if errNo != 0 { err = FormatSysError(errNo); return }
	if bytesWritten < size { err = fmt.Errorf("Could not write all bytes.") }
	return
}

func ReadBytes(process windows.Handle, address uint64, count uint64) (value []byte, err error) {
	if count == 0 { 
		value = make([]byte, 0)
		return
	}
	var bytesRead uintptr
	value = make([]byte, count)
	errNo := ReadProcessMemory(process, uintptr(address), unsafe.Pointer(&value[0]), uintptr(count), &bytesRead)
	if errNo != 0 { err = FormatSysError(errNo);; return }
	if bytesRead < uintptr(count) { err = fmt.Errorf("Could not read all bytes."); return }
	return
}

// Module cache for a single process
type ModuleCache map[string]windows.Handle 
// A map of module caches for multiple processes
type ModuleCaches map[windows.Handle]ModuleCache
var moduleCaches ModuleCaches = make(ModuleCaches)
var moduleCacheMutex sync.RWMutex
//
func GetExternalModuleHandle(process windows.Handle, moduleName string) (handle windows.Handle, err error) {
	moduleCacheMutex.RLock()
	var moduleCache = moduleCaches[process]
	moduleCacheMutex.RUnlock()
	
	if moduleCache == nil {
		moduleCache = make(ModuleCache)

		moduleCacheMutex.Lock()
		moduleCaches[process] = moduleCache
		moduleCacheMutex.Unlock()
	}

	moduleCacheMutex.RLock()
	cached := moduleCache[moduleName]
	moduleCacheMutex.RUnlock()

	if cached != 0 {
		handle = cached
		return
	}

	var modules [1024]windows.Handle
	var returnedBytes uint32
	e := windows.EnumProcessModulesEx(
		process,
		&modules[0],
		uint32(unsafe.Sizeof(modules)),
		&returnedBytes,
		windows.LIST_MODULES_ALL,
	)
	if e != nil {
		err = fmt.Errorf("Error enumerating process moudles (make sure you have PROCESS_QUERY_INFORMATION access):\n%s", e.Error())
	}

	
	modulesReturned := uintptr(returnedBytes) / unsafe.Sizeof(windows.Handle(0))
	for i := uintptr(0); i < modulesReturned; i++ {
		module := modules[i]
		buffer := make([]uint16, windows.MAX_PATH)
		windows.GetModuleBaseName(process, module, &buffer[0], windows.MAX_PATH)
		name := syscall.UTF16ToString(buffer)
		
		moduleCacheMutex.Lock()
		moduleCache[name] = module
		moduleCacheMutex.Unlock()
	}

	moduleCacheMutex.RLock()
	handle = moduleCache[moduleName]
	moduleCacheMutex.RUnlock()

	return
}
