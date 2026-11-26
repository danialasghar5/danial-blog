class CreateInvoices < ActiveRecord::Migration[7.1]
  def change
    create_table :invoices do |t|
      t.references :order, foreign_key: true
      t.string :number
      t.index :number
    end
  end
end
