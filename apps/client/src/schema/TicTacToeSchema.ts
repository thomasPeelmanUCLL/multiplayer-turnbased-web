import { Schema, type, ArraySchema } from '@colyseus/schema';

export class PlayersSchema extends Schema {
  @type('string') X: string = '';
  @type('string') O: string = '';
}

export class TicTacToeSchema extends Schema {
  @type(['string']) board = new ArraySchema<string>(
    '', '', '', '', '', '', '', '', ''
  );
  @type('string') phase: string = 'waiting';
  @type('string') currentPlayer: string = 'X';
  @type('string') winner: string = '';
  @type(PlayersSchema) players = new PlayersSchema();
}
