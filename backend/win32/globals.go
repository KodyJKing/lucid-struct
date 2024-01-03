package win32

import "golang.org/x/sys/windows"

var PROCESS_ALL_ACCESS = uint32(windows.SYNCHRONIZE | windows.STANDARD_RIGHTS_REQUIRED | 0xFFFF)