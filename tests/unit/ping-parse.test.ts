import { describe, expect, it } from "vitest";
import { parsePingStdout } from "../../src/server/probes/ping.ts";

const LINUX_OK = `
PING 1.1.1.1 (1.1.1.1) 56(84) bytes of data.
64 bytes from 1.1.1.1: icmp_seq=1 ttl=57 time=12.3 ms
64 bytes from 1.1.1.1: icmp_seq=2 ttl=57 time=11.8 ms

--- 1.1.1.1 ping statistics ---
8 packets transmitted, 8 received, 0% packet loss, time 1401ms
rtt min/avg/max/mdev = 11.234/12.456/14.123/0.890 ms
`;

const DARWIN_OK = `
PING 1.1.1.1 (1.1.1.1): 56 data bytes
64 bytes from 1.1.1.1: icmp_seq=0 ttl=57 time=12.345 ms

--- 1.1.1.1 ping statistics ---
8 packets transmitted, 8 packets received, 0.0% packet loss
round-trip min/avg/max/stddev = 11.234/12.456/14.123/0.890 ms
`;

const LINUX_LOSS = `
--- 8.8.8.8 ping statistics ---
8 packets transmitted, 6 received, 25% packet loss, time 1405ms
rtt min/avg/max/mdev = 20.1/22.5/30.0/3.2 ms
`;

const DARWIN_LOSS = `
--- 8.8.8.8 ping statistics ---
5 packets transmitted, 3 packets received, 40.0% packet loss
`;

describe("parsePingStdout", () => {
	it("parses Linux iputils (mdev) output", () => {
		const stats = parsePingStdout(LINUX_OK);
		expect(stats.sent).toBe(8);
		expect(stats.lost).toBe(0);
		expect(stats.lossPct).toBe(0);
		expect(stats.minMs).toBeCloseTo(11.234);
		expect(stats.avgMs).toBeCloseTo(12.456);
		expect(stats.maxMs).toBeCloseTo(14.123);
		expect(stats.stddevMs).toBeCloseTo(0.89);
	});

	it("parses Darwin (stddev, packets received) output", () => {
		const stats = parsePingStdout(DARWIN_OK);
		expect(stats.sent).toBe(8);
		expect(stats.lost).toBe(0);
		expect(stats.lossPct).toBe(0);
		expect(stats.minMs).toBeCloseTo(11.234);
		expect(stats.avgMs).toBeCloseTo(12.456);
		expect(stats.stddevMs).toBeCloseTo(0.89);
	});

	it("parses Linux loss percentage", () => {
		const stats = parsePingStdout(LINUX_LOSS);
		expect(stats.sent).toBe(8);
		expect(stats.lost).toBe(2);
		expect(stats.lossPct).toBe(25);
		expect(stats.avgMs).toBeCloseTo(22.5);
	});

	it("parses Darwin 100% or partial loss without rtt line", () => {
		const stats = parsePingStdout(DARWIN_LOSS);
		expect(stats.sent).toBe(5);
		expect(stats.lost).toBe(2);
		expect(stats.lossPct).toBe(40);
		expect(stats.minMs).toBeNull();
		expect(stats.avgMs).toBeNull();
		expect(stats.stddevMs).toBeNull();
	});

	it("returns empty stats for unrelated text", () => {
		const stats = parsePingStdout("permission denied");
		expect(stats).toEqual({
			sent: 0,
			lost: 0,
			lossPct: 0,
			minMs: null,
			avgMs: null,
			maxMs: null,
			stddevMs: null,
		});
	});
});
