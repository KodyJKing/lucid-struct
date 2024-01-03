package win32

import (
	"fmt"
	"testing"
)

func TestEnumProcessInfo(t *testing.T) {
	infos, err := EnumProcessInfo()
	if err != nil { t.Fatalf("Error enumerating processes:\n%s", err.Error()) }
	for _, info := range infos {
		fmt.Printf("%X - %s\n", info.Pid, info.Filename)
	}
	fmt.Printf("Process result count: %d\n", len(infos))
	// t.Fail()
}

func TestEnumAppProcessInfo(t *testing.T) {
	infos := EnumAppProcessInfo()
	for _, info := range infos {
		fmt.Printf("%X - %s\n", info.Pid, info.Filename)
	}
	fmt.Printf("App result count: %d\n", len(infos))
	// t.Fail()
}
