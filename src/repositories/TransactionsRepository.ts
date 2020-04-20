import { EntityRepository, Repository } from 'typeorm';

import Transaction from '../models/Transaction';

interface Balance {
  income: number;
  outcome: number;
  total: number;
}

@EntityRepository(Transaction)
class TransactionsRepository extends Repository<Transaction> {
  public async getBalance(): Promise<Balance> {
    const transactions = await this.find();
    const balance = transactions.reduce(
      (result: Balance, transaction: Transaction) => {
        const newResult = result;

        if (transaction.type === 'income') {
          newResult.income += transaction.value;
        }

        if (transaction.type === 'outcome') {
          newResult.outcome += transaction.value;
        }

        newResult.total = newResult.income - newResult.outcome;

        return newResult;
      },
      { income: 0, outcome: 0, total: 0 },
    );

    return balance;
  }
}

export default TransactionsRepository;
