// Original score. Render offline with the macOS General MIDI instruments.
import AVFoundation
import Foundation

struct Cue: Decodable { let bpm: Double; let durationSeconds: Double }
struct Event { let sample: Int; let instrument: Int; let note: UInt8; let velocity: UInt8 }
let root = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
let cue = try JSONDecoder().decode(Cue.self, from: Data(contentsOf: root.appendingPathComponent("timing.json")))
let sampleRate = 48000.0
let beat = 60.0 / cue.bpm
precondition(abs(cue.durationSeconds - 28 * beat) < 0.001, "This arrangement has seven four-beat bars.")
let engine = AVAudioEngine()
let format = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 2)!
let bus = AVAudioMixerNode()
let reverb = AVAudioUnitReverb()
engine.attach(bus); engine.attach(reverb)
reverb.loadFactoryPreset(.mediumHall); reverb.wetDryMix = 17
engine.connect(bus, to: reverb, format: format)
engine.connect(reverb, to: engine.mainMixerNode, format: format)
let bank = URL(fileURLWithPath: "/System/Library/Components/CoreAudio.component/Contents/Resources/gs_instruments.dls")
let programs: [UInt8] = [0, 0, 48, 33, 0]
let volumes: [Float] = [0.34, 0.35, 0.18, 0.20, 0.17]
var instruments: [AVAudioUnitSampler] = []
for (index, program) in programs.enumerated() {
    let instrument = AVAudioUnitSampler()
    engine.attach(instrument)
    try instrument.loadSoundBankInstrument(at: bank, program: program, bankMSB: index == 4 ? 120 : 121, bankLSB: 0)
    engine.connect(instrument, to: bus, format: format)
    instrument.volume = volumes[index]
    instruments.append(instrument)
}
var events: [Event] = []
func note(_ instrument: Int, _ pitch: Int, _ at: Double, _ duration: Double, _ velocity: Int) {
    events.append(Event(sample: Int(at * sampleRate), instrument: instrument, note: UInt8(pitch), velocity: UInt8(velocity)))
    events.append(Event(sample: Int((at + duration) * sampleRate), instrument: instrument, note: UInt8(pitch), velocity: 0))
}
let chords = [[62,66,69,74,76], [55,62,67,71,74], [59,62,66,71,74], [57,61,64,69,74], [62,66,69,74,76], [57,61,64,69,76], [62,66,69,74,78]]
let roots = [38,43,35,33,38,33,38]
let melody = [[74,76,78], [79,78,76], [78,81,78], [79,78,76], [78,76,74], [76,73,69], [74]]
for bar in 0..<7 {
    let start = Double(bar * 4) * beat
    let energetic = bar < 4
    let chord = chords[bar]
    for (j, degree) in [0,2,1,3,0,2,4,3].enumerated() where bar < 6 || j < 2 {
        note(0, chord[degree], start + Double(j) * beat / 2, beat * 0.43, energetic ? 66 + bar * 4 + (j % 2 == 0 ? 7 : 0) : 54)
    }
    for pitch in chord.prefix(4) { note(2, pitch, start, bar == 6 ? 2.7 : 2.8, energetic ? 44 + bar * 6 : 62) }
    for j in 0..<(energetic ? 2 : 1) { note(3, roots[bar], start + Double(j * 2) * beat, energetic ? 1.3 : 2.4, 64) }
    for (j, pitch) in melody[bar].enumerated() {
        let offset = j == 0 ? 0.0 : Double(j + 1) * beat
        note(1, pitch, start + offset, bar == 6 ? 2.7 : (j == 0 ? 1.25 : 0.58), energetic ? 76 + bar * 3 : 68)
    }
    if energetic {
        for b in 0..<4 {
            note(4, b % 2 == 0 ? 36 : 38, start + Double(b) * beat, 0.12, b % 2 == 0 ? 78 : 47)
        }
        if bar > 0 {
            for b in 0..<8 { note(4, 42, start + Double(b) * beat / 2, 0.08, b % 2 == 0 ? 35 : 24) }
        }
    }
    if bar == 4 || bar == 6 { note(4, 49, start, 1.3, bar == 4 ? 40 : 28) }
}
events.sort { $0.sample == $1.sample ? $0.velocity < $1.velocity : $0.sample < $1.sample }
try engine.enableManualRenderingMode(.offline, format: format, maximumFrameCount: 512)
try engine.start()
let rawURL = CommandLine.arguments.count > 2 ? URL(fileURLWithPath: CommandLine.arguments[2]) : root.appendingPathComponent("score-raw.caf")
let output = try AVAudioFile(forWriting: rawURL, settings: format.settings, commonFormat: .pcmFormatFloat32, interleaved: false)
let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 512)!
let end = Int(cue.durationSeconds * sampleRate)
var cursor = 0, eventIndex = 0, stalls = 0
while cursor < end {
    while eventIndex < events.count && events[eventIndex].sample <= cursor {
        let event = events[eventIndex]
        let instrument = instruments[event.instrument]
        if event.velocity == 0 { instrument.stopNote(event.note, onChannel: 0) }
        else { instrument.startNote(event.note, withVelocity: event.velocity, onChannel: 0) }
        eventIndex += 1
    }
    let next = eventIndex < events.count ? events[eventIndex].sample : end
    let count = AVAudioFrameCount(min(512, end - cursor, max(1, next - cursor)))
    let status = try engine.renderOffline(count, to: buffer)
    if status == .success && buffer.frameLength > 0 {
        try output.write(from: buffer)
        cursor += Int(buffer.frameLength); stalls = 0
    } else {
        stalls += 1
        if stalls > 100 { fatalError("Offline audio rendering stalled: \(status)") }
    }
}
engine.stop()
print("Original \(cue.bpm) BPM score rendered: \(cue.durationSeconds) seconds.")
