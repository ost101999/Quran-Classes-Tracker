import test from 'node:test';
import assert from 'node:assert/strict';
import { localizeAudioPaths } from '../localize-audio.mjs';
test('incoming audio retains this device path only for the same recording', () => {
    const remote = { answer: { audioBase64: 'recording', audioLocalPath: 'C:\\audio' } };
    const local = { answer: { audioBase64: 'recording', audioLocalPath: '/mac/audio' } };
    assert.equal(localizeAudioPaths(remote, local).answer.audioLocalPath, '/mac/audio');
    assert.equal(localizeAudioPaths(remote, {}).answer.audioLocalPath, undefined);
    assert.equal(localizeAudioPaths(remote, { answer: { audioBase64: 'older', audioLocalPath: '/mac/old' } }).answer.audioLocalPath, undefined);
    assert.equal(remote.answer.audioLocalPath, 'C:\\audio');
});
