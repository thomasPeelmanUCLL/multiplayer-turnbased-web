import { Schema, type, ArraySchema } from '@colyseus/schema';

export class TicTacToeSchema extends Schema {
  @type(['string']) board = new ArraySchema<string>(
    '', '', '', '', '', '', '', '', ''
  );
  @type('string') phase: string = 'waiting';
  @type('string') currentPlayer: string = 'X';
  @type('string') winner: string = '';
  @type('string') playerX: string = '';
  @type('string') playerO: string = '';
}
