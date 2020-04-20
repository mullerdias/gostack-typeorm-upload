import fs from 'fs';
import parse from 'csv-parse';
import { getCustomRepository, getRepository, In } from 'typeorm';

import AppError from '../errors/AppError';

import Category from '../models/Category';
import Transaction from '../models/Transaction';
import TransactionsRepository from '../repositories/TransactionsRepository';

interface TransactionCSV {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}

class ImportTransactionsService {
  async execute(filePath: string): Promise<Transaction[]> {
    const transactionsRepository = getCustomRepository(TransactionsRepository);
    const categoriesRepository = getRepository(Category);
    const balance = await transactionsRepository.getBalance();

    const transactions: TransactionCSV[] = [];
    const categories: string[] = [];
    const balanceCSV = { income: 0, outcome: 0 };

    const csv = fs
      .createReadStream(filePath)
      .pipe(parse({ columns: true, trim: true }));

    csv.on('data', async (row: TransactionCSV) => {
      transactions.push(row);
      categories.push(row.category);
      switch (row.type) {
        case 'income':
          balanceCSV.income += Number(row.value);
          break;
        case 'outcome':
          balanceCSV.outcome += Number(row.value);
          break;
        default:
          break;
      }
    });

    await new Promise((resolve, reject) => {
      csv.on('error', async err => {
        await fs.promises.unlink(filePath);
        reject(err);
      });
      csv.on('end', async () => {
        await fs.promises.unlink(filePath);
        resolve();
      });
    });

    if (balance.total + balanceCSV.income - balanceCSV.outcome < 0) {
      throw new AppError('The total balance cannot be less than zero.');
    }

    const existentCategories = await categoriesRepository.find({
      where: {
        title: In(categories),
      },
    });

    const existentCategoriesTitles = existentCategories.map(
      category => category.title,
    );

    const addCategoryTitles = categories
      .filter(category => !existentCategoriesTitles.includes(category))
      .filter((value, index, self) => self.indexOf(value) === index);

    const newCategories = categoriesRepository.create(
      addCategoryTitles.map(title => ({ title })),
    );

    await categoriesRepository.save(newCategories);

    const allCategories = [...newCategories, ...existentCategories];

    const newTransations = transactionsRepository.create(
      transactions.map(transaction => ({
        title: transaction.title,
        type: transaction.type,
        value: transaction.value,
        category: allCategories.find(
          category => category.title === transaction.category,
        ),
      })),
    );

    await transactionsRepository.save(newTransations);

    return newTransations;
  }
}

export default ImportTransactionsService;
