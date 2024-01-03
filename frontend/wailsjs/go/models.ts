export namespace win32 {
	
	export class ProcessInfo {
	    pid: number;
	    filename: string;
	
	    static createFrom(source: any = {}) {
	        return new ProcessInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.pid = source["pid"];
	        this.filename = source["filename"];
	    }
	}

}

