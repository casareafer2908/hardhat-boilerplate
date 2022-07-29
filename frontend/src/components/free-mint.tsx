import React from "react";

export function FreeMint({ freeMint }) {
  return (
    <div>
      <h4>Free Mint Section</h4>
      <form
        onSubmit={(event) => {
          // This function calls the free mint
          event.preventDefault();
          freeMint()
        }}
      >
        <div className="form-group">
          <input className="btn btn-primary" type="submit" value="Free Mint" />
        </div>
      </form>
    </div>
  );
}
