import {test} from 'node:test';import assert from 'node:assert/strict';
import {actionTiming,ACTION_FRAME_DEADLINE_MS,RUNTIME_FEEDBACK_SCHEMA} from '../controller-spec.mjs';
test('timing feedback reports observed milliseconds and simulated work separately',()=>{
 assert.equal(ACTION_FRAME_DEADLINE_MS,5000);assert.equal(RUNTIME_FEEDBACK_SCHEMA,'wall-clock-v1');
 assert.deepEqual(actionTiming('step',{duration:.1},1000,1250,1420),{tool:'step',simulatedDurationSeconds:.1,solverSubsteps:12,responseMs:250,frameMs:420});
 assert.equal(actionTiming('step',{duration:.02},1000,1010,1050).solverSubsteps,3);
 assert.deepEqual(actionTiming('inspect',{},1000,1010,1200),{tool:'inspect',simulatedDurationSeconds:null,solverSubsteps:0,responseMs:10,frameMs:200});
});
test('timing cannot conceal late frames, invalid timestamps or unsupported durations',()=>{
 for(const values of [['step',{duration:.1},1000,1200,6001],['step',{duration:.1},1000,999,1100],['step',{duration:.1},1000,1100,999],['step',{duration:NaN},1000,1100,1200],['step',{duration:.51},1000,1100,1200],['observe',{},1000,1100,1200],['finish',{},1000,NaN,1200]])assert.throws(()=>actionTiming(...values));
 assert.equal(actionTiming('finish',{},1000,1100,6000).frameMs,5000);
});
