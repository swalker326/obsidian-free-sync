import { VaultSnapshot } from "./types";

export class SnapshotManager {
	private snapshot: VaultSnapshot;
	private subscribers: ((snapshot: VaultSnapshot) => void)[] = [];

	updateSnapshot(newSnapshot: VaultSnapshot) {
		this.snapshot = newSnapshot;
		this.notifySubscribers();
	}

	getSnapshot() {
		return this.snapshot;
	}

	subscribe(callback: (snapshot: VaultSnapshot) => void) {
		this.subscribers.push(callback);
	}

	private notifySubscribers() {
		for (const cb of this.subscribers) {
			cb(this.snapshot);
		}
	}
}
