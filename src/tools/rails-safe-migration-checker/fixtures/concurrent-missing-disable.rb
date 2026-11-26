class AddCustomerIndexConcurrently < ActiveRecord::Migration[7.1]
  def change
    add_index :orders, :customer_id, algorithm: :concurrently
  end
end
