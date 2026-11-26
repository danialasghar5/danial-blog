class SafeOrderChanges < ActiveRecord::Migration[7.1]
  disable_ddl_transaction!

  def change
    create_table :refunds do |t|
      t.bigint :order_id, null: false
      t.integer :amount_cents, null: false, default: 0
      t.timestamps
    end

    add_index :orders, :status, algorithm: :concurrently
    validate_foreign_key :orders, :customers
    change_column_default :orders, :priority, from: nil, to: 0
  end
end
