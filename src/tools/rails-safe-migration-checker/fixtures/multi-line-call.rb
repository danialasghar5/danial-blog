class AddOrderIndexes < ActiveRecord::Migration[7.1]
  def change
    add_index(
      :orders,
      [:customer_id, :created_at],
      unique: false,
      name: "index_orders_customer_created"
    )
  end
end
