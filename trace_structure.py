# Structure analysis for lines 267-454

structure = """
Line 267: ) : (                          <- else branch starts
Line 268: <div>                           <- DIV 1: Main else content wrapper
  Line 270-299: {selectedCustomers...}   <- Conditional block (floating bar)
  Line 301: <div>                         <- DIV 2: Table wrapper
    Line 302: <div>                       <- DIV 3: overflow-x-auto
      ...table content...
    Line 406: </div>                      <- CLOSE DIV 3
  Line 407: </div>                        <- CLOSE DIV 2
Line 408: )}                              <- CLOSE conditional (but WHAT conditional?)

Line 410: {/* Paginación */}
Line 411: {!loading && customers.length > 0 && (  <- NEW conditional starts
  Line 412: <div>                         <- DIV 4: Pagination wrapper
    ...pagination content...
  Line 451: </div>                        <- CLOSE DIV 4
Line 452: </div>                          <- EXTRA CLOSE! (no matching open)
Line 453: )}                              <- CLOSE pagination conditional
Line 454: </div>                          <- Should close DIV 1 from line 268
"""

print(structure)
print("\n" + "="*70)
print("PROBLEM IDENTIFIED:")
print("="*70)
print("Line 408 has a closing ')}' but there's NO conditional wrapping")
print("the table section (lines 301-407).")
print("")
print("Line 452 has an extra '</div>' that doesn't match any opening tag.")
print("")
print("These are TWO SEPARATE ERRORS causing the 'Adjacent JSX elements' issue.")
